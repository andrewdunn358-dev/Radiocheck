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
