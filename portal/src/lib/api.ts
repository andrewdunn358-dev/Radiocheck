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

  const response = await fetch(`${API_URL}/api${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
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
  // Auth
  login: (email: string, password: string) =>
    fetchAPI<StaffLoginResponse>('/staff/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  // Profile & Status
  getProfile: (token: string) =>
    fetchAPI<StaffProfile>('/staff/profile', { token }),
  updateStatus: (token: string, status: string) =>
    fetchAPI<ActionResponse>('/staff/status', {
      token,
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  // Safeguarding Alerts
  getSafeguardingAlerts: (token: string) =>
    fetchAPI<SafeguardingAlert[]>('/safeguarding-alerts', { token }),
  acknowledgeSafeguardingAlert: (token: string, id: string) =>
    fetchAPI<ActionResponse>(`/safeguarding-alerts/${id}/acknowledge`, { token, method: 'PUT' }),
  resolveSafeguardingAlert: (token: string, id: string) =>
    fetchAPI<ActionResponse>(`/safeguarding-alerts/${id}/resolve`, { token, method: 'PUT' }),

  // Panic Alerts
  getPanicAlerts: (token: string) =>
    fetchAPI<PanicAlert[]>('/panic-alerts', { token }),
  acknowledgePanicAlert: (token: string, id: string) =>
    fetchAPI<ActionResponse>(`/panic-alerts/${id}/acknowledge`, { token, method: 'PUT' }),
  resolvePanicAlert: (token: string, id: string) =>
    fetchAPI<ActionResponse>(`/panic-alerts/${id}/resolve`, { token, method: 'PUT' }),
  triggerPanic: (token: string) =>
    fetchAPI<ActionResponse>('/panic/trigger', { token, method: 'POST' }),

  // Live Chat
  getLiveChatRooms: (token: string) =>
    fetchAPI<LiveChatRoom[]>('/live-chat/rooms', { token }),
  getLiveChatMessages: (token: string, roomId: string) =>
    fetchAPI<LiveChatMessage[]>(`/live-chat/rooms/${roomId}/messages`, { token }),
  sendLiveChatMessage: (token: string, roomId: string, message: string) =>
    fetchAPI<ActionResponse>(`/live-chat/rooms/${roomId}/messages`, {
      token,
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  joinLiveChat: (token: string, roomId: string) =>
    fetchAPI<ActionResponse>(`/live-chat/rooms/${roomId}/join`, { token, method: 'POST' }),
  endLiveChat: (token: string, roomId: string) =>
    fetchAPI<ActionResponse>(`/live-chat/rooms/${roomId}/end`, { token, method: 'PUT' }),

  // Cases
  getCases: (token: string) =>
    fetchAPI<CasesResponse>('/cases', { token }),
  getCase: (token: string, id: string) =>
    fetchAPI<CaseDetail>(`/cases/${id}`, { token }),
  createCase: (token: string, data: CreateCaseData) =>
    fetchAPI<ActionResponse>('/cases', { token, method: 'POST', body: JSON.stringify(data) }),
  addCaseNote: (token: string, caseId: string, note: string) =>
    fetchAPI<ActionResponse>(`/cases/${caseId}/notes`, {
      token,
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  updateSafetyPlan: (token: string, caseId: string, plan: string) =>
    fetchAPI<ActionResponse>(`/cases/${caseId}/safety-plan`, {
      token,
      method: 'PUT',
      body: JSON.stringify({ safety_plan: plan }),
    }),
  escalateCase: (token: string, caseId: string, reason: string) =>
    fetchAPI<ActionResponse>(`/cases/${caseId}/escalate`, {
      token,
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  getMorningReview: (token: string) =>
    fetchAPI<CasesResponse>('/cases/morning-review', { token }),

  // Callbacks
  getCallbacks: (token: string) =>
    fetchAPI<Callback[]>('/callbacks', { token }),
  takeCallback: (token: string, id: string) =>
    fetchAPI<ActionResponse>(`/callbacks/${id}/take`, { token, method: 'PUT' }),
  completeCallback: (token: string, id: string) =>
    fetchAPI<ActionResponse>(`/callbacks/${id}/complete`, { token, method: 'PUT' }),
  releaseCallback: (token: string, id: string) =>
    fetchAPI<ActionResponse>(`/callbacks/${id}/release`, { token, method: 'PUT' }),

  // Shifts/Rota
  getShifts: (token: string) =>
    fetchAPI<Shift[]>('/shifts', { token }),
  createShift: (token: string, data: CreateShiftData) =>
    fetchAPI<ActionResponse>('/shifts', { token, method: 'POST', body: JSON.stringify(data) }),
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

  // Team
  getTeamOnDuty: (token: string) =>
    fetchAPI<TeamMember[]>('/staff/on-duty', { token }),
  getStaffList: (token: string) =>
    fetchAPI<TeamMember[]>('/staff/team', { token }),

  // Notes
  getNotes: (token: string) =>
    fetchAPI<StaffNote[]>('/notes', { token }),
  createNote: (token: string, data: CreateNoteData) =>
    fetchAPI<ActionResponse>('/notes', { token, method: 'POST', body: JSON.stringify(data) }),
  updateNote: (token: string, id: string, data: Partial<CreateNoteData>) =>
    fetchAPI<ActionResponse>(`/notes/${id}`, { token, method: 'PUT', body: JSON.stringify(data) }),
  deleteNote: (token: string, id: string) =>
    fetchAPI<ActionResponse>(`/notes/${id}`, { token, method: 'DELETE' }),

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
  role: string;
  status: 'available' | 'busy' | 'offline';
  phone?: string;
  is_supervisor?: boolean;
  specializations?: string[];
}

export interface SafeguardingAlert {
  _id: string;
  id?: string;
  user_id?: string;
  user_name?: string;
  session_id?: string;
  character_id?: string;
  character_name?: string;
  trigger_message: string;
  trigger_phrases?: string[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  notes?: string;
  conversation_history?: Array<{ role: string; content: string }>;
}

export interface PanicAlert {
  _id: string;
  user_id?: string;
  user_name?: string;
  location?: string;
  status: 'active' | 'acknowledged' | 'resolved';
  responded_by_name?: string;
  created_at: string;
}

export interface LiveChatRoom {
  _id: string;
  room_id: string;
  user_id: string;
  user_name?: string;
  status: 'waiting' | 'active' | 'ended';
  staff_id?: string;
  staff_name?: string;
  created_at: string;
  last_message_at?: string;
  message_count?: number;
}

export interface LiveChatMessage {
  _id: string;
  room_id: string;
  sender_type: 'user' | 'staff';
  sender_name: string;
  message: string;
  created_at: string;
}

export interface CasesResponse {
  cases: Case[];
}

export interface Case {
  _id: string;
  case_number: string;
  user_id?: string;
  user_name?: string;
  status: 'open' | 'in_progress' | 'escalated' | 'closed';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  assigned_to?: string;
  assigned_to_name?: string;
  created_at: string;
  updated_at: string;
  summary?: string;
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
  _id: string;
  user_id?: string;
  user_name: string;
  phone: string;
  reason?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'taken' | 'completed';
  taken_by?: string;
  taken_by_name?: string;
  created_at: string;
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
  shift_type: string;
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
  _id: string;
  id?: string;
  name: string;
  email?: string;
  role: string;
  status?: string;
  is_supervisor?: boolean;
}

export interface StaffNote {
  _id: string;
  title: string;
  content: string;
  is_shared: boolean;
  shared_with?: string[];
  created_by: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateNoteData {
  title: string;
  content: string;
  is_shared?: boolean;
  shared_with?: string[];
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

