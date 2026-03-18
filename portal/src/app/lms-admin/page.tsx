'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { lmsAdminApi, lmsApi, CourseData, Registration, LearnerListItem } from '@/lib/api';
import Link from 'next/link';
import { 
  GraduationCap, LogOut, LayoutDashboard, UserPlus, Users, Book, 
  HelpCircle, Award, Bell, ChevronRight, Check, X, Eye, Trash2, Key, Edit, Plus
} from 'lucide-react';

type TabType = 'dashboard' | 'registrations' | 'learners' | 'modules' | 'certificates';

export default function LMSAdminPage() {
  const { user, isLoading, login, logout } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [learners, setLearners] = useState<LearnerListItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Modal states
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [showAddLearner, setShowAddLearner] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, activeTab]);

  const loadData = async () => {
    try {
      const course = await lmsApi.getCourse();
      setCourseData(course);

      if (activeTab === 'dashboard' || activeTab === 'registrations') {
        const regData = await lmsAdminApi.getRegistrations();
        setRegistrations(regData.registrations || []);
      }

      if (activeTab === 'dashboard' || activeTab === 'learners') {
        const learnData = await lmsAdminApi.getLearners();
        setLearners(learnData.learners || []);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(loginEmail, loginPassword);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await lmsAdminApi.approveRegistration(id);
      setSelectedRegistration(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to approve');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Optional: Enter a reason for rejection:');
    try {
      await lmsAdminApi.rejectRegistration(id, reason || undefined);
      setSelectedRegistration(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to reject');
    }
  };

  const handleAddLearner = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    try {
      await lmsAdminApi.addLearner({
        full_name: formData.get('name') as string,
        email: formData.get('email') as string,
        password: formData.get('password') as string,
        notes: formData.get('notes') as string || undefined,
      });
      setShowAddLearner(false);
      loadData();
      alert('Learner added successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to add learner');
    }
  };

  const handleDeleteLearner = async (email: string, name: string) => {
    if (!confirm(`Delete ${name} (${email})? This cannot be undone.`)) return;
    try {
      await lmsAdminApi.deleteLearner(email);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const handleResetPassword = async (email: string) => {
    const newPassword = prompt('Enter new password (min 8 characters):');
    if (!newPassword || newPassword.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }
    try {
      await lmsAdminApi.resetPassword(email, newPassword);
      alert('Password reset successfully');
    } catch (err: any) {
      alert(err.message || 'Failed to reset password');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
      </div>
    );
  }

  // Login Screen
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-dark via-primary to-primary-dark p-4">
        <div className="bg-card border border-border rounded-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <GraduationCap className="w-16 h-16 text-secondary mx-auto mb-4" />
            <h2 className="text-2xl font-bold">LMS Admin Login</h2>
            <p className="text-gray-400 text-sm mt-1">Sign in with your admin account</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Email Address</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                placeholder="admin@radiocheck.me"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                placeholder="Enter your password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-light hover:bg-primary text-white rounded-lg font-semibold disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-gray-500">
            Use the same credentials as the main admin portal
          </p>
        </div>
      </div>
    );
  }

  // Main Admin Dashboard
  const pendingCount = registrations.filter(r => r.status === 'pending').length;
  const completedCount = learners.filter(l => l.progress_percent === 100).length;
  const certificateCount = learners.filter(l => l.certificate_issued).length;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'registrations', label: 'Registrations', icon: UserPlus, badge: pendingCount },
    { id: 'learners', label: 'Learners', icon: Users },
    { id: 'modules', label: 'Course Modules', icon: Book },
    { id: 'certificates', label: 'Certificates', icon: Award },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <Link href="/" className="flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-secondary" />
            <span className="font-semibold">LMS Admin</span>
          </Link>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as TabType)}
                className={`w-full flex items-center gap-3 px-6 py-3 text-left transition-colors ${
                  activeTab === item.id
                    ? 'bg-secondary/10 text-secondary border-l-2 border-secondary'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white border-l-2 border-transparent'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="ml-auto px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="text-sm text-gray-400 mb-2">{user.email}</div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-gray-400 hover:text-white"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div>
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-secondary" />
              Dashboard
            </h1>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <div className="text-3xl font-bold text-secondary">{pendingCount}</div>
                <div className="text-sm text-gray-400">Pending Registrations</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <div className="text-3xl font-bold text-secondary">{learners.length}</div>
                <div className="text-sm text-gray-400">Active Learners</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <div className="text-3xl font-bold text-secondary">{completedCount}</div>
                <div className="text-sm text-gray-400">Completed Course</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <div className="text-3xl font-bold text-secondary">{certificateCount}</div>
                <div className="text-sm text-gray-400">Certificates Issued</div>
              </div>
            </div>

            {/* Recent Registrations */}
            <div className="bg-card border border-border rounded-xl p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Recent Registrations</h3>
                <button onClick={() => setActiveTab('registrations')} className="text-sm text-secondary hover:underline">
                  View All
                </button>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-400 border-b border-border">
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Email</th>
                    <th className="pb-3">Veteran</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.slice(0, 5).map((reg) => (
                    <tr key={reg._id} className="border-b border-border/50">
                      <td className="py-3">{reg.full_name}</td>
                      <td className="py-3 text-gray-400">{reg.email}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${reg.is_veteran ? 'bg-green-500/20 text-green-400' : 'bg-primary-light/50'}`}>
                          {reg.is_veteran ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          reg.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          reg.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {reg.status}
                        </span>
                      </td>
                      <td className="py-3 text-gray-400">{new Date(reg.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Course Info */}
            {courseData && (
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="font-semibold mb-4">Course Overview</h3>
                <p><strong>Course:</strong> {courseData.title}</p>
                <p><strong>Duration:</strong> {courseData.duration_hours} hours</p>
                <p><strong>Modules:</strong> {courseData.module_count}</p>
              </div>
            )}
          </div>
        )}

        {/* Registrations */}
        {activeTab === 'registrations' && (
          <div>
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-secondary" />
              Volunteer Registrations
            </h1>

            <div className="bg-card border border-border rounded-xl p-6">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-400 border-b border-border">
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Email</th>
                    <th className="pb-3">Veteran</th>
                    <th className="pb-3">DBS</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((reg) => (
                    <tr key={reg._id} className="border-b border-border/50">
                      <td className="py-3">{reg.full_name}</td>
                      <td className="py-3 text-gray-400">{reg.email}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${reg.is_veteran ? 'bg-green-500/20 text-green-400' : 'bg-primary-light/50'}`}>
                          {reg.is_veteran ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${reg.has_dbs ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {reg.has_dbs ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          reg.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          reg.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {reg.status}
                        </span>
                      </td>
                      <td className="py-3 text-gray-400">{new Date(reg.created_at).toLocaleDateString()}</td>
                      <td className="py-3">
                        <button
                          onClick={() => setSelectedRegistration(reg)}
                          className="p-2 hover:bg-white/5 rounded"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Learners */}
        {activeTab === 'learners' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Users className="w-6 h-6 text-secondary" />
                Learners
              </h1>
              <button
                onClick={() => setShowAddLearner(true)}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-primary-dark rounded-lg hover:bg-secondary-light"
              >
                <Plus className="w-4 h-4" />
                Add Learner
              </button>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-400 border-b border-border">
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Email</th>
                    <th className="pb-3">Progress</th>
                    <th className="pb-3">Enrolled</th>
                    <th className="pb-3">Certificate</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {learners.map((learner) => (
                    <tr key={learner.email} className="border-b border-border/50">
                      <td className="py-3">{learner.full_name}</td>
                      <td className="py-3 text-gray-400">{learner.email}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-border rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-secondary rounded-full" 
                              style={{ width: `${learner.progress_percent}%` }}
                            />
                          </div>
                          <span className="text-sm">{learner.progress_percent}%</span>
                        </div>
                      </td>
                      <td className="py-3 text-gray-400">{new Date(learner.enrolled_at).toLocaleDateString()}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${learner.certificate_issued ? 'bg-green-500/20 text-green-400' : 'bg-primary-light/50'}`}>
                          {learner.certificate_issued ? 'Issued' : 'Not yet'}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          <button 
                            onClick={() => handleResetPassword(learner.email)}
                            className="p-2 hover:bg-white/5 rounded" title="Reset Password"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteLearner(learner.email, learner.full_name)}
                            className="p-2 hover:bg-red-500/20 rounded text-red-400" title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modules */}
        {activeTab === 'modules' && courseData && (
          <div>
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Book className="w-6 h-6 text-secondary" />
              Course Modules
            </h1>

            <div className="space-y-4">
              {courseData.modules.map((module, index) => (
                <div key={module.id} className="bg-card border border-border rounded-xl p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold mb-1">
                        {index + 1}. {module.title}
                        {module.is_critical && (
                          <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                            Critical - 100% Required
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-400 mb-2">{module.description}</p>
                      <p className="text-xs text-gray-500">{module.duration_minutes} minutes</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Certificates */}
        {activeTab === 'certificates' && (
          <div>
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Award className="w-6 h-6 text-secondary" />
              Certificates
            </h1>

            <div className="bg-card border border-border rounded-xl p-6">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-400 border-b border-border">
                    <th className="pb-3">Learner</th>
                    <th className="pb-3">Email</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {learners.filter(l => l.certificate_issued).map((learner) => (
                    <tr key={learner.email} className="border-b border-border/50">
                      <td className="py-3">{learner.full_name}</td>
                      <td className="py-3 text-gray-400">{learner.email}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">Issued</span>
                      </td>
                    </tr>
                  ))}
                  {learners.filter(l => l.certificate_issued).length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-gray-500">No certificates issued yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Registration Detail Modal */}
      {selectedRegistration && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedRegistration(null)}>
          <div className="bg-card rounded-xl border border-border w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="text-xl font-semibold">Registration Details</h2>
              <button onClick={() => setSelectedRegistration(null)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="text-sm text-gray-400">Full Name</label><p>{selectedRegistration.full_name}</p></div>
              <div><label className="text-sm text-gray-400">Email</label><p>{selectedRegistration.email}</p></div>
              <div><label className="text-sm text-gray-400">Phone</label><p>{selectedRegistration.phone || 'Not provided'}</p></div>
              <div><label className="text-sm text-gray-400">Veteran</label><p>{selectedRegistration.is_veteran ? 'Yes' : 'No'}</p></div>
              {selectedRegistration.is_veteran && (
                <>
                  <div><label className="text-sm text-gray-400">Service Branch</label><p>{selectedRegistration.service_branch || 'Not specified'}</p></div>
                  <div><label className="text-sm text-gray-400">Years Served</label><p>{selectedRegistration.years_served || 'Not specified'}</p></div>
                </>
              )}
              <div><label className="text-sm text-gray-400">Why They Want to Volunteer</label><p className="whitespace-pre-wrap">{selectedRegistration.why_volunteer}</p></div>
              <div><label className="text-sm text-gray-400">Has DBS</label><p>{selectedRegistration.has_dbs ? 'Yes' : 'No - Will need to apply'}</p></div>
              <div><label className="text-sm text-gray-400">Status</label>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  selectedRegistration.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                  selectedRegistration.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {selectedRegistration.status}
                </span>
              </div>
            </div>
            {selectedRegistration.status === 'pending' && (
              <div className="p-6 border-t border-border flex gap-4 justify-end">
                <button
                  onClick={() => handleReject(selectedRegistration._id)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
                <button
                  onClick={() => handleApprove(selectedRegistration._id)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  <Check className="w-4 h-4" />
                  Approve & Enroll
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Learner Modal */}
      {showAddLearner && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowAddLearner(false)}>
          <div className="bg-card rounded-xl border border-border w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Plus className="w-5 h-5 text-secondary" />
                Add Learner Manually
              </h2>
              <button onClick={() => setShowAddLearner(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <form onSubmit={handleAddLearner} className="p-6">
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Full Name *</label>
                <input type="text" name="name" required className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none" />
              </div>
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Email Address *</label>
                <input type="email" name="email" required className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none" />
              </div>
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Password *</label>
                <input type="password" name="password" required minLength={8} className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none" placeholder="Min 8 characters" />
              </div>
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">Notes (Optional)</label>
                <textarea name="notes" rows={3} className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none resize-none"></textarea>
              </div>
              <button type="submit" className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold">
                Add & Enroll Learner
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
