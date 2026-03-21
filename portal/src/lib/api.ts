const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://veterans-support-api.onrender.com';

interface FetchOptions extends RequestInit {
  token?: string;
}

async function fetchAPI<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const url = `${API_URL}/api${endpoint}`;
  console.log(`[API] Fetching: ${url}`);
  
  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  console.log(`[API] Response: ${response.status} ${response.statusText} for ${endpoint}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    console.error(`[API] Error for ${endpoint}:`, error);
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// LMS Learner API
export const lmsApi = {
  // Course
  getCourse: () => fetchAPI<CourseData>('/lms/course'),
  getModule: (moduleId: string, learnerEmail: string) => 
    fetchAPI<ModuleResponse>(`/lms/module/${moduleId}?learner_email=${encodeURIComponent(learnerEmail)}`),
  
  // Auth
  login: (email: string, password: string) =>
    fetchAPI<LoginResponse>('/lms/learner/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  setPassword: (email: string, password: string, confirmPassword: string) =>
    fetchAPI<LoginResponse>('/lms/learner/set-password', {
      method: 'POST',
      body: JSON.stringify({ email, password, confirm_password: confirmPassword }),
    }),
  register: (data: RegistrationData) =>
    fetchAPI<RegistrationResponse>('/lms/volunteer/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  // Progress
  getProgress: (email: string) =>
    fetchAPI<ProgressData>(`/lms/progress/${encodeURIComponent(email)}`),
  
  // Quiz
  submitQuiz: (learnerEmail: string, moduleId: string, answers: Record<string, string>) =>
    fetchAPI<QuizResults>(`/lms/quiz/submit?learner_email=${encodeURIComponent(learnerEmail)}`, {
      method: 'POST',
      body: JSON.stringify({ module_id: moduleId, answers }),
    }),
  
  // Certificate
  generateCertificate: (learnerEmail: string) =>
    fetchAPI<CertificateResponse>(`/lms/certificate/generate?learner_email=${encodeURIComponent(learnerEmail)}`, {
      method: 'POST',
    }),
  
  // Tutor Chat
  chatWithTutor: (learnerEmail: string, message: string, currentModule?: string) =>
    fetchAPI<TutorChatResponse>('/lms/tutor/chat', {
      method: 'POST',
      body: JSON.stringify({ learner_email: learnerEmail, message, current_module: currentModule }),
    }),
};

// LMS Admin API
export const lmsAdminApi = {
  // Auth (uses main admin auth)
  login: (email: string, password: string) =>
    fetchAPI<AdminLoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  
  // Registrations
  getRegistrations: () =>
    fetchAPI<RegistrationsResponse>('/lms/admin/registrations'),
  approveRegistration: (id: string) =>
    fetchAPI<ActionResponse>(`/lms/admin/registration/${id}/approve`, { method: 'POST' }),
  rejectRegistration: (id: string, reason?: string) =>
    fetchAPI<ActionResponse>(`/lms/admin/registration/${id}/reject`, {
      method: 'POST',
      body: reason ? JSON.stringify({ reason }) : undefined,
    }),
  
  // Learners
  getLearners: () =>
    fetchAPI<LearnersResponse>('/lms/admin/learners'),
  getLearner: (email: string) =>
    fetchAPI<LearnerDetailResponse>(`/lms/admin/learner/${encodeURIComponent(email)}`),
  addLearner: (data: AddLearnerData) =>
    fetchAPI<ActionResponse>('/lms/admin/learner/add', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateLearner: (email: string, data: UpdateLearnerData) =>
    fetchAPI<ActionResponse>(`/lms/admin/learner/${encodeURIComponent(email)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  resetPassword: (email: string, newPassword: string) =>
    fetchAPI<ActionResponse>(`/lms/admin/learner/${encodeURIComponent(email)}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password: newPassword }),
    }),
  deleteLearner: (email: string) =>
    fetchAPI<ActionResponse>(`/lms/admin/learner/${encodeURIComponent(email)}`, {
      method: 'DELETE',
    }),
  
  // Modules
  getModuleAdmin: (moduleId: string) =>
    fetchAPI<ModuleAdminResponse>(`/lms/admin/module/${moduleId}`),
};

// Types
export interface CourseData {
  title: string;
  duration_hours: number;
  module_count: number;
  dbs_link: string;
  modules: ModuleSummary[];
}

export interface ModuleSummary {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  order: number;
  is_critical: boolean;
}

export interface ModuleResponse {
  module: ModuleDetail;
  is_completed: boolean;
  quiz_score?: number;
}

export interface ModuleDetail extends ModuleSummary {
  content: string;
  image_url?: string;
  external_links?: { title: string; url: string }[];
  quiz: Quiz;
}

export interface Quiz {
  title: string;
  questions: QuizQuestion[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface LoginResponse {
  token: string;
  learner?: LearnerData;
}

export interface LearnerData {
  email: string;
  full_name: string;
  certificate_issued: boolean;
  certificate_id?: string;
}

export interface RegistrationData {
  full_name: string;
  email: string;
  phone?: string;
  is_veteran: boolean;
  service_branch?: string;
  years_served?: string;
  why_volunteer: string;
  has_dbs: boolean;
  agreed_to_terms: boolean;
}

export interface RegistrationResponse {
  success: boolean;
  message: string;
  next_steps: string[];
}

export interface ProgressData {
  learner: LearnerData;
  progress_percent: number;
  completed_modules: number;
  total_modules: number;
  can_get_certificate: boolean;
  modules_status: ModuleStatus[];
}

export interface ModuleStatus {
  id: string;
  completed: boolean;
  score?: number;
}

export interface QuizResults {
  passed: boolean;
  score: number;
  required_score: number;
  is_critical_module: boolean;
  results: QuizResultItem[];
}

export interface QuizResultItem {
  question: string;
  your_answer: string;
  is_correct: boolean;
  explanation: string;
}

export interface CertificateResponse {
  success: boolean;
  certificate_id: string;
  learner_name: string;
  issued_date: string;
}

export interface TutorChatResponse {
  response: string;
}

// Admin Types
export interface AdminLoginResponse {
  token: string;
  user: AdminUser;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
}

export interface RegistrationsResponse {
  registrations: Registration[];
}

export interface Registration {
  _id: string;
  full_name: string;
  email: string;
  phone?: string;
  is_veteran: boolean;
  service_branch?: string;
  years_served?: string;
  why_volunteer: string;
  has_dbs: boolean;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface LearnersResponse {
  learners: LearnerListItem[];
}

export interface LearnerListItem {
  email: string;
  full_name: string;
  progress_percent: number;
  enrolled_at: string;
  certificate_issued: boolean;
  manual_add_notes?: string;
}

export interface LearnerDetailResponse {
  learner: LearnerListItem;
}

export interface AddLearnerData {
  full_name: string;
  email: string;
  password: string;
  notes?: string;
}

export interface UpdateLearnerData {
  full_name?: string;
  notes?: string;
}

export interface ActionResponse {
  success: boolean;
  message?: string;
  detail?: string;
}

export interface ModuleAdminResponse extends ModuleDetail {}

// ============================================
// STAFF PORTAL API
// ============================================

export const staffApi = {
  // Auth - uses the main auth endpoint
  login: (email: string, password: string) =>
    fetchAPI<StaffLoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  // Profile & Status - NOW uses the unified staff endpoint
  getProfile: async (token: string, userId?: string): Promise<StaffProfile | null> => {
    console.log('[API] getProfile called with userId:', userId);
    
    // Try the new unified staff endpoint first
    try {
      console.log('[API] Fetching from /staff/me (unified)...');
      const profile = await fetchAPI<any>('/staff/me', { token });
      console.log('[API] Unified staff profile:', profile);
      
      if (profile && profile.id) {
        // Check if user has a full profile or just basic info
        if (profile.has_profile === false) {
          console.log('[API] User exists but has no profile linked');
          return null;
        }
        
        return {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role,
          status: profile.status || 'unavailable',
          phone: profile.phone,
          is_supervisor: profile.is_supervisor,
          specializations: profile.specialization ? [profile.specialization] : undefined,
          user_id: profile.legacy_user_id || profile.id,
          // CRITICAL: callable_user_id is the ID that mobile apps use for WebRTC calls
          // Staff portal MUST register with this ID for calls to work
          callable_user_id: profile.callable_user_id || profile.legacy_user_id || profile.id,
          _source: profile._source  // Track where data came from
        } as StaffProfile;
      }
    } catch (e) {
      console.log('[API] Unified staff endpoint failed, falling back to legacy...', e);
    }
    
    // FALLBACK: Try legacy endpoints for backward compatibility
    // This can be removed after migration is complete
    if (!userId) {
      console.log('[API] No userId provided for legacy fallback, cannot find profile');
      return null;
    }
    
    try {
      console.log('[API] Fetching counsellors (legacy)...');
      const counsellors = await fetchAPI<any[]>('/counsellors', { token });
      if (counsellors && counsellors.length > 0) {
        const match = counsellors.find((c: any) => c.user_id === userId);
        if (match) {
          const profileId = match.id || match._id;
          return { 
            ...match, 
            id: profileId,
            role: 'counsellor',
            user_id: match.user_id,
            _source: 'legacy_counsellors'
          } as StaffProfile;
        }
      }
    } catch (e) { 
      console.error('[API] Error fetching counsellors:', e);
    }
    
    try {
      console.log('[API] Fetching peer-supporters (legacy)...');
      const peers = await fetchAPI<any[]>('/peer-supporters', { token });
      if (peers && peers.length > 0) {
        const match = peers.find((p: any) => p.user_id === userId);
        if (match) {
          const profileId = match.id || match._id;
          return { 
            ...match, 
            id: profileId,
            role: 'peer',
            user_id: match.user_id,
            _source: 'legacy_peers'
          } as StaffProfile;
        }
      }
    } catch (e) { 
      console.error('[API] Error fetching peer-supporters:', e);
    }
    
    // No profile found
    console.log('[API] No profile found for userId:', userId);
    return null;
  },
  
  // Status update - now also supports unified staff endpoint
  updateStatus: async (token: string, status: string, staffId: string, staffType: 'counsellor' | 'peer' | 'staff') => {
    // Use unified endpoint with user_id
    return fetchAPI<ActionResponse>(`/staff/${staffId}/status`, {
      token,
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // Safeguarding Alerts
  getSafeguardingAlerts: (token: string) =>
    fetchAPI<SafeguardingAlert[]>('/safeguarding-alerts', { token }),
  acknowledgeSafeguardingAlert: (token: string, id: string) =>
    fetchAPI<ActionResponse>(`/safeguarding-alerts/${id}/acknowledge`, { token, method: 'PATCH' }),
  resolveSafeguardingAlert: (token: string, id: string, notes?: string) =>
    fetchAPI<ActionResponse>(`/safeguarding-alerts/${id}/resolve`, { 
      token, 
      method: 'PATCH',
      body: notes ? JSON.stringify({ notes }) : undefined,
    }),

  // Panic Alerts
  getPanicAlerts: (token: string) =>
    fetchAPI<PanicAlert[]>('/panic-alerts', { token }),
  acknowledgePanicAlert: (token: string, id: string) =>
    fetchAPI<ActionResponse>(`/panic-alerts/${id}/acknowledge`, { token, method: 'PATCH' }),
  resolvePanicAlert: (token: string, id: string) =>
    fetchAPI<ActionResponse>(`/panic-alerts/${id}/resolve`, { token, method: 'PATCH' }),
  triggerPanic: (token: string) =>
    fetchAPI<ActionResponse>('/panic-alert', { token, method: 'POST' }),

  // Live Chat
  getLiveChatRooms: (token: string) =>
    fetchAPI<LiveChatRoom[]>('/live-chat/rooms', { token }),
  getLiveChatMessages: async (token: string, roomId: string): Promise<LiveChatMessage[]> => {
    const response = await fetchAPI<{ messages: LiveChatMessage[] }>(`/live-chat/rooms/${roomId}/messages`, { token });
    return response?.messages || [];
  },
  sendLiveChatMessage: (token: string, roomId: string, message: string) =>
    fetchAPI<ActionResponse>(`/live-chat/rooms/${roomId}/messages`, {
      token,
      method: 'POST',
      body: JSON.stringify({ text: message, sender: 'staff' }),
    }),
  joinLiveChat: (token: string, roomId: string, staffId: string, staffName: string) =>
    fetchAPI<ActionResponse>(`/live-chat/rooms/${roomId}/join`, { 
      token, 
      method: 'POST',
      body: JSON.stringify({ staff_id: staffId, staff_name: staffName }),
    }),
  endLiveChat: (token: string, roomId: string) =>
    fetchAPI<ActionResponse>(`/live-chat/rooms/${roomId}/end`, { token, method: 'POST' }),

  // Cases
  getCases: (token: string, filter?: string) =>
    fetchAPI<Case[]>(`/cases${filter ? `?status=${filter}` : ''}`, { token }),
  getCase: (token: string, id: string) =>
    fetchAPI<CaseDetail>(`/cases/${id}`, { token }),
  getCaseSessions: (token: string, caseId: string) =>
    fetchAPI<any[]>(`/cases/${caseId}/sessions`, { token }),
  createCase: (token: string, data: CreateCaseData) =>
    fetchAPI<ActionResponse>('/cases', { token, method: 'POST', body: JSON.stringify(data) }),
  addCaseSession: (token: string, caseId: string, sessionData: any) =>
    fetchAPI<ActionResponse>(`/cases/${caseId}/sessions`, {
      token,
      method: 'POST',
      body: JSON.stringify(sessionData),
    }),
  updateSafetyPlan: (token: string, caseId: string, plan: string) =>
    fetchAPI<ActionResponse>(`/cases/${caseId}/safety-plan`, {
      token,
      method: 'PUT',
      body: JSON.stringify({ safety_plan: plan }),
    }),
  addReferral: (token: string, caseId: string, referralData: any) =>
    fetchAPI<ActionResponse>(`/cases/${caseId}/referrals`, {
      token,
      method: 'POST',
      body: JSON.stringify(referralData),
    }),
  getMorningReview: (token: string) =>
    fetchAPI<Case[]>('/cases/morning-queue', { token }),

  // Callbacks
  getCallbacks: (token: string) =>
    fetchAPI<Callback[]>('/callbacks', { token }),
  takeCallback: (token: string, id: string) =>
    fetchAPI<ActionResponse>(`/callbacks/${id}/take`, { token, method: 'PATCH' }),
  completeCallback: (token: string, id: string) =>
    fetchAPI<ActionResponse>(`/callbacks/${id}/complete`, { token, method: 'PATCH' }),
  releaseCallback: (token: string, id: string) =>
    fetchAPI<ActionResponse>(`/callbacks/${id}/release`, { token, method: 'PATCH' }),

  // Shifts/Rota
  getShifts: (token: string, dateFrom?: string, dateTo?: string) => {
    const params = new URLSearchParams();
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    return fetchAPI<Shift[]>(`/shifts${params.toString() ? '?' + params.toString() : ''}`, { token });
  },
  createShift: (token: string, data: CreateShiftData, userId: string, userName: string, userEmail: string) => {
    const params = new URLSearchParams();
    params.append('user_id', userId);
    params.append('user_name', userName);
    params.append('user_email', userEmail);
    return fetchAPI<ActionResponse>(`/shifts/?${params.toString()}`, { 
      token, 
      method: 'POST', 
      body: JSON.stringify(data) 
    });
  },
  updateShift: (token: string, id: string, data: Partial<CreateShiftData>) =>
    fetchAPI<ActionResponse>(`/shifts/${id}`, { token, method: 'PUT', body: JSON.stringify(data) }),
  deleteShift: (token: string, id: string) =>
    fetchAPI<ActionResponse>(`/shifts/${id}`, { token, method: 'DELETE' }),
  getSwapRequests: (token: string) =>
    fetchAPI<ShiftSwap[]>('/shift-swaps', { token }),
  createSwapRequest: (token: string, shiftId: string, reason: string) =>
    fetchAPI<ActionResponse>('/shift-swaps', {
      token,
      method: 'POST',
      body: JSON.stringify({ shift_id: shiftId, reason }),
    }),

  // Team - get counsellors and peer supporters
  getTeamOnDuty: async (token: string): Promise<TeamMember[]> => {
    const [counsellors, peers] = await Promise.all([
      fetchAPI<any[]>('/counsellors', { token }).catch(() => []),
      fetchAPI<any[]>('/peer-supporters', { token }).catch(() => []),
    ]);
    return [
      ...counsellors.map((c: any) => ({ 
        ...c, 
        role: 'counsellor',
        name: c.name || c.firstName || 'Unknown Counsellor'
      })),
      ...peers.map((p: any) => ({ 
        ...p, 
        role: 'peer',
        name: p.name || p.firstName || 'Unknown Peer'
      })),
    ];
  },
  getStaffList: (token: string) =>
    fetchAPI<TeamMember[]>('/staff-users', { token }),

  // Notes
  getNotes: (token: string, relatedTo?: string, relatedType?: string) => {
    const params = new URLSearchParams();
    params.append('include_shared', 'true');
    if (relatedTo) params.append('related_to', relatedTo);
    if (relatedType) params.append('related_type', relatedType);
    return fetchAPI<{notes: StaffNote[], count: number}>(`/notes?${params.toString()}`, { token });
  },
  getNote: (token: string, id: string) =>
    fetchAPI<StaffNote>(`/notes/${id}`, { token }),
  createNote: (token: string, data: CreateNoteData) =>
    fetchAPI<{message: string, id: string, note: StaffNote}>('/notes', { token, method: 'POST', body: JSON.stringify(data) }),
  updateNote: (token: string, id: string, data: Partial<CreateNoteData>) =>
    fetchAPI<ActionResponse>(`/notes/${id}`, { token, method: 'PUT', body: JSON.stringify(data) }),
  deleteNote: (token: string, id: string) =>
    fetchAPI<ActionResponse>(`/notes/${id}`, { token, method: 'DELETE' }),
  shareNote: (token: string, id: string, shareWith: string[]) =>
    fetchAPI<ActionResponse>(`/notes/${id}/share`, { token, method: 'POST', body: JSON.stringify({ share_with: shareWith }) }),

  // Internal Messages
  getMessages: (token: string) =>
    fetchAPI<{messages: InternalMessage[], unread_count: number}>('/messages', { token }),
  sendMessage: (token: string, data: CreateMessageData) =>
    fetchAPI<ActionResponse>('/messages', { token, method: 'POST', body: JSON.stringify(data) }),
  markMessageRead: (token: string, id: string) =>
    fetchAPI<ActionResponse>(`/messages/${id}/read`, { token, method: 'PATCH' }),
  markAllMessagesRead: (token: string) =>
    fetchAPI<ActionResponse>('/messages/read-all', { token, method: 'PATCH' }),

  // Supervision (supervisors only)
  getEscalations: (token: string) =>
    fetchAPI<Escalation[]>('/escalations', { token }),
  acknowledgeEscalation: (token: string, id: string) =>
    fetchAPI<ActionResponse>(`/escalations/${id}/acknowledge`, { token, method: 'PUT' }),
  resolveEscalation: (token: string, id: string) =>
    fetchAPI<ActionResponse>(`/escalations/${id}/resolve`, { token, method: 'PUT' }),
  getSupervisionNotes: (token: string, staffId?: string) =>
    fetchAPI<SupervisionNote[]>(`/supervision/notes${staffId ? `?staff_id=${staffId}` : ''}`, { token }),
  createSupervisionNote: (token: string, data: CreateSupervisionNoteData) =>
    fetchAPI<ActionResponse>('/supervision/notes', { token, method: 'POST', body: JSON.stringify(data) }),

  // Learning/Feedback
  submitFeedback: (token: string, staffId: string, feedback: any) =>
    fetchAPI<ActionResponse>(`/learning/feedback?staff_id=${staffId}`, {
      token,
      method: 'POST',
      body: JSON.stringify(feedback),
    }),

  // WebRTC status
  getOnlineStaff: (token: string) =>
    fetchAPI<any>('/webrtc/online-staff', { token }),

  // Twilio Phone API
  getTwilioStatus: () =>
    fetchAPI<{ configured: boolean; phone_number?: string; features?: { browser_calling: boolean; outbound_calls: boolean } }>('/twilio/status'),

  getTwilioToken: async (staffId: string, staffName: string): Promise<{ token: string; identity: string; ttl: number } | null> => {
    try {
      const formData = new FormData();
      formData.append('staff_id', staffId);
      formData.append('staff_name', staffName);

      const response = await fetch(`${API_URL}/api/twilio/token`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Token request failed');
      return await response.json();
    } catch (error) {
      console.error('Failed to get Twilio token:', error);
      return null;
    }
  },

  getActiveCalls: (token: string) =>
    fetchAPI<any[]>('/twilio/active-calls', { token }),
};

// Staff Portal Types
export interface StaffLoginResponse {
  token: string;
  user: StaffUser;
}

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: 'counsellor' | 'peer' | 'admin';
  is_supervisor?: boolean;
}

export interface StaffProfile {
  id: string;
  email: string;
  name: string;
  role: string;  // 'admin' | 'supervisor' | 'counsellor' | 'peer'
  status: 'available' | 'busy' | 'offline' | 'limited' | 'unavailable' | 'off';
  phone?: string;
  is_supervisor?: boolean;
  specializations?: string[];
  // For peers
  area?: string;
  background?: string;
  years_served?: string;
  // Link fields
  user_id?: string;  // Link to legacy User record (if migrated)
  // Metadata
  _source?: string;  // 'unified' | 'legacy_counsellors' | 'legacy_peers' | 'legacy_no_profile'
}

export interface SafeguardingAlert {
  id: string;  // Primary ID field from backend
  _id?: string;
  user_id?: string;
  user_name?: string;
  session_id?: string;
  character_id?: string;
  character?: string;
  character_name?: string;
  triggering_message?: string;
  trigger_message?: string;
  ai_response?: string;
  trigger_phrases?: string[];
  triggered_indicators?: string[];
  risk_level: string; // GREEN, YELLOW, AMBER, RED (backend uses uppercase)
  risk_score?: number;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  notes?: string;
  conversation_history?: Array<{ role: string; content: string }>;
  // Tracking info (matching backend field names)
  contact_captured?: boolean;
  client_ip?: string;  // Backend uses client_ip
  ip_address?: string; // Alias
  user_agent?: string;
  // Geolocation fields (from backend)
  geo_city?: string;
  geo_region?: string;
  geo_country?: string;
  geo_isp?: string;
  geo_timezone?: string;
  geo_lat?: number;
  geo_lon?: number;
  location?: string;  // Computed field
}

export interface PanicAlert {
  id?: string;
  _id: string;
  user_id?: string;
  user_name?: string;
  triggered_by_name?: string;
  triggered_by_role?: string;
  message?: string;
  phone?: string;
  location?: string;
  status: 'active' | 'acknowledged' | 'resolved';
  responded_by_name?: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
}

export interface LiveChatRoom {
  id?: string;  // Backend uses 'id'
  _id?: string;
  room_id?: string;
  user_id?: string;
  user_name?: string;
  status: 'waiting' | 'active' | 'ended';
  staff_id?: string;
  staff_name?: string;
  staff_type?: string;
  safeguarding_alert_id?: string;
  risk_level?: string;  // From safeguarding alert (RED, AMBER, etc.)
  ai_session_id?: string;
  messages?: any[];
  created_at: string;
  ended_at?: string;
  last_message_at?: string;
  message_count?: number;
}

export interface LiveChatMessage {
  id?: string;
  _id?: string;
  room_id?: string;
  sender: 'user' | 'staff';  // Backend uses 'sender' not 'sender_type'
  sender_name?: string;
  text: string;  // Backend uses 'text' not 'message'
  timestamp: string;  // Backend uses 'timestamp' not 'created_at'
}

export interface CasesResponse {
  cases: Case[];
}

export interface Case {
  _id: string;
  case_number: string;
  user_id?: string;
  user_name?: string;
  status: 'open' | 'active' | 'in_progress' | 'escalated' | 'closed';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  assigned_to?: string;
  assigned_to_name?: string;
  created_at: string;
  updated_at: string;
  summary?: string;
  description?: string;
  session_count?: number;
  safety_plan?: string;
}

export interface CaseDetail extends Case {
  notes: CaseNote[];
  safety_plan?: string;
  referrals?: Referral[];
  timeline?: TimelineEvent[];
}

export interface CaseNote {
  _id: string;
  note: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
}

export interface Referral {
  _id: string;
  type: string;
  organization?: string;
  status: string;
  created_at: string;
}

export interface TimelineEvent {
  type: string;
  description: string;
  created_at: string;
  created_by?: string;
}

export interface CreateCaseData {
  user_id?: string;
  user_name?: string;
  summary: string;
  risk_level: string;
  source?: string;
  alert_id?: string;
}

export interface Callback {
  id: string;  // Primary ID field (not _id)
  _id?: string;  // Optional MongoDB _id
  user_id?: string;
  user_name: string;
  name?: string;  // Legacy field name
  phone: string;
  reason?: string;
  message?: string;  // Legacy field name
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'taken' | 'completed' | 'in_progress' | 'released';
  request_type?: 'peer' | 'counsellor';
  taken_by?: string;
  taken_by_name?: string;
  assigned_to?: string;  // Legacy field
  assigned_name?: string;  // Legacy field
  is_urgent?: boolean;
  safeguarding_alert_id?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
}

export interface Shift {
  _id: string;
  staff_id: string;
  staff_name?: string;
  date: string;
  start_time: string;
  end_time: string;
  shift_type: 'morning' | 'afternoon' | 'evening' | 'night';
  notes?: string;
}

export interface CreateShiftData {
  date: string;
  start_time: string;
  end_time: string;
  notes?: string;
}

export interface ShiftSwap {
  _id: string;
  shift_id: string;
  requested_by: string;
  requested_by_name?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface TeamMember {
  _id?: string;
  id?: string;
  user_id?: string;
  name: string;
  email?: string;
  role: string;
  status?: string;
  is_supervisor?: boolean;
  specialization?: string;
  phone?: string;
}

export interface StaffNote {
  _id?: string;
  id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  author_role?: string;
  related_to?: string;
  related_type?: 'callback' | 'alert' | 'case' | 'session' | 'general';
  is_shared: boolean;
  share_with?: string[];
  shared_with?: string[];  // Alias for backwards compatibility
  tags?: string[];
  created_by?: string;  // Legacy field
  created_by_name?: string;  // Legacy field
  created_at: string;
  updated_at: string;
}

export interface CreateNoteData {
  title: string;
  content: string;
  related_to?: string;
  related_type?: 'callback' | 'alert' | 'case' | 'session' | 'general';
  is_shared?: boolean;
  share_with?: string[];
  tags?: string[];
}

export interface Escalation {
  _id: string;
  case_id?: string;
  reason: string;
  escalated_by: string;
  escalated_by_name?: string;
  status: 'pending' | 'acknowledged' | 'resolved';
  created_at: string;
}

export interface SupervisionNote {
  _id: string;
  staff_id: string;
  staff_name?: string;
  note: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
}

export interface CreateSupervisionNoteData {
  staff_id: string;
  note: string;
}



export interface InternalMessage {
  id: string;
  from_id: string;
  from_name: string;
  to_id: string;
  to_name: string;
  content: string;
  read: boolean;
  created_at: string;
}

export interface CreateMessageData {
  to_id: string;
  content: string;
}
