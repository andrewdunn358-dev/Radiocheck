'use client';

import { useState, useEffect } from 'react';
import { useLearnerAuth } from '@/hooks/useLearnerAuth';
import { lmsApi, CourseData, ModuleSummary } from '@/lib/api';
import { LogIn, LogOut, UserPlus, Clock, Award, Shield, Check, Lock, Brain, HandHelping, Scale, MessageSquare, AlertTriangle, Heart, Users, BookOpen, ClipboardCheck, Phone, Home, GraduationCap, Trophy } from 'lucide-react';
import Link from 'next/link';

const MODULE_ICONS = [Brain, HandHelping, Scale, MessageSquare, AlertTriangle, Heart, Shield, Users, BookOpen, ClipboardCheck, Phone, Home, Award, GraduationCap];

export default function LearningPage() {
  const { learner, progress, isLoading, login, setPassword, logout } = useLearnerAuth();
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCourse();
  }, []);

  const loadCourse = async () => {
    try {
      const data = await lmsApi.getCourse();
      setCourseData(data);
    } catch (err) {
      console.error('Failed to load course:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;

    try {
      const result = await login(email, password);
      if (result.needsPassword) {
        setPendingEmail(email);
        setShowLogin(false);
        setShowSetPassword(true);
      } else {
        setShowLogin(false);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const form = e.currentTarget;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem('confirmPassword') as HTMLInputElement).value;

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      await setPassword(pendingEmail, password, confirmPassword);
      setShowSetPassword(false);
    } catch (err: any) {
      setError(err.message || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      await lmsApi.register({
        full_name: formData.get('name') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string || undefined,
        is_veteran: formData.get('isVeteran') === 'on',
        service_branch: formData.get('branch') as string || undefined,
        years_served: formData.get('years') as string || undefined,
        why_volunteer: formData.get('why') as string,
        has_dbs: formData.get('hasDBS') === 'on',
        agreed_to_terms: formData.get('terms') === 'on',
      });
      setShowRegister(false);
      alert('Registration submitted! You will be contacted when approved.');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
      </div>
    );
  }

  // Logged in - show dashboard
  if (learner && progress) {
    return (
      <div className="min-h-screen">
        {/* Header */}
        <header className="bg-primary border-b-4 border-secondary px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <img 
                src="https://customer-assets.emergentagent.com/job_535ca64e-70e1-4fc8-813d-3b487fc07905/artifacts/14k1x3vl_logo.png"
                alt="Radio Check"
                className="w-10 h-10"
              />
              <span className="text-lg font-semibold">Peer to Peer Training</span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-gray-400">{learner.full_name}</span>
              <button onClick={logout} className="flex items-center gap-2 text-gray-400 hover:text-white">
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard */}
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">Welcome back, {learner.full_name.split(' ')[0]}</h1>
              <p className="text-gray-400">Continue your Mental Health First Aid training</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <svg viewBox="0 0 36 36" className="w-20 h-20">
                  <path
                    className="text-border"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.8"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-secondary"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeDasharray={`${progress.progress_percent}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <text x="18" y="20.35" fill="currentColor" fontSize="0.5em" textAnchor="middle" className="font-bold">
                    {progress.progress_percent}%
                  </text>
                </svg>
              </div>
              <div className="text-sm text-gray-400">
                {progress.completed_modules} of {progress.total_modules} modules complete
              </div>
            </div>
          </div>

          {/* Modules Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courseData?.modules.map((module, index) => {
              const status = progress.modules_status.find(s => s.id === module.id);
              const isCompleted = status?.completed;
              const isLocked = index > 0 && !progress.modules_status[index - 1]?.completed && !isCompleted;
              const isCurrent = !isCompleted && (index === 0 || progress.modules_status[index - 1]?.completed);
              const IconComponent = MODULE_ICONS[index % MODULE_ICONS.length];

              return (
                <Link
                  key={module.id}
                  href={isLocked ? '#' : `/learning/module/${module.id}`}
                  className={`module-card ${isCompleted ? 'completed' : ''} ${isLocked ? 'locked' : ''} ${isCurrent ? 'border-secondary' : ''}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${isCompleted ? 'bg-green-500/20 text-green-500' : 'bg-secondary/20 text-secondary'}`}>
                    {isCompleted ? <Check className="w-5 h-5" /> : isLocked ? <Lock className="w-5 h-5" /> : <span className="font-bold">{index + 1}</span>}
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-primary-light/30 flex items-center justify-center mb-4">
                    <IconComponent className="w-6 h-6 text-secondary" />
                  </div>
                  <h3 className="font-semibold mb-2">{module.title}</h3>
                  <p className="text-sm text-gray-400 mb-4">{module.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {module.duration_minutes} min
                    </span>
                    {isCompleted && status?.score && (
                      <span className="text-green-500">{status.score}%</span>
                    )}
                    {module.is_critical && (
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">Critical</span>
                    )}
                    {isLocked && <Lock className="w-3 h-3" />}
                  </div>
                </Link>
              );
            })}

            {/* Certificate Card */}
            {progress.can_get_certificate && (
              <Link
                href="/learning/certificate"
                className="module-card completed"
                style={{ background: 'linear-gradient(135deg, rgba(201, 162, 39, 0.2), rgba(30, 58, 95, 0.3))' }}
              >
                <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center mb-4">
                  <Trophy className="w-5 h-5 text-secondary" />
                </div>
                <div className="w-12 h-12 rounded-lg bg-secondary/30 flex items-center justify-center mb-4">
                  <Award className="w-6 h-6 text-secondary" />
                </div>
                <h3 className="font-semibold mb-2">Get Your Certificate</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Congratulations! Claim your Radio Check Peer Supporter Certificate.
                </p>
                <div className="flex items-center gap-1 text-xs text-secondary">
                  <Award className="w-3 h-3" />
                  Course Complete!
                </div>
              </Link>
            )}
          </div>
        </main>
      </div>
    );
  }

  // Landing page (not logged in)
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-primary border-b-4 border-secondary px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img 
              src="https://customer-assets.emergentagent.com/job_535ca64e-70e1-4fc8-813d-3b487fc07905/artifacts/14k1x3vl_logo.png"
              alt="Radio Check"
              className="w-10 h-10"
            />
            <span className="text-lg font-semibold">Peer to Peer Training</span>
          </Link>
          <button 
            onClick={() => setShowLogin(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-600 rounded-lg hover:bg-white/5"
          >
            <LogIn className="w-4 h-4" />
            Login
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">Peer to Peer Training</h1>
            <p className="text-xl text-secondary mb-2">Become a certified Radio Check peer support volunteer</p>
            <p className="text-gray-400 mb-8">
              Learn to recognise signs of mental health difficulties, provide initial support, 
              and help fellow veterans access the help they need.
            </p>

            <div className="flex gap-8 mb-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-secondary">{courseData?.module_count || 14}</div>
                <div className="text-sm text-gray-400">Modules</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-secondary">16</div>
                <div className="text-sm text-gray-400">Hours</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-secondary">Free</div>
                <div className="text-sm text-gray-400">Cost</div>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setShowRegister(true)}
                className="flex items-center gap-2 px-6 py-3 bg-secondary text-primary-dark font-semibold rounded-lg hover:bg-secondary-light"
              >
                <UserPlus className="w-5 h-5" />
                Register Interest
              </button>
              <button 
                onClick={() => setShowLogin(true)}
                className="flex items-center gap-2 px-6 py-3 border border-gray-600 rounded-lg hover:bg-white/5"
              >
                <LogIn className="w-5 h-5" />
                Already Enrolled? Login
              </button>
            </div>
          </div>

          <div className="bg-card rounded-xl p-6 border border-border">
            <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
              <BookOpen className="w-5 h-5 text-secondary" />
              Course Overview
            </h3>
            <ul className="space-y-3">
              {(courseData?.modules.slice(0, 6) || []).map((m, i) => (
                <li key={i} className="flex items-center gap-3 text-gray-300">
                  <Check className="w-4 h-4 text-green-500" />
                  {m.title}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Info Cards */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-card rounded-xl p-6 border border-border text-center">
            <div className="w-14 h-14 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-7 h-7 text-secondary" />
            </div>
            <h3 className="font-semibold mb-2">Self-Paced Learning</h3>
            <p className="text-sm text-gray-400">Complete the course at your own pace. Progress is saved automatically.</p>
          </div>
          <div className="bg-card rounded-xl p-6 border border-border text-center">
            <div className="w-14 h-14 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Award className="w-7 h-7 text-secondary" />
            </div>
            <h3 className="font-semibold mb-2">Official Certificate</h3>
            <p className="text-sm text-gray-400">Receive a Radio Check Peer Supporter Certificate upon completion.</p>
          </div>
          <div className="bg-card rounded-xl p-6 border border-border text-center">
            <div className="w-14 h-14 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-7 h-7 text-secondary" />
            </div>
            <h3 className="font-semibold mb-2">BACP Compliant</h3>
            <p className="text-sm text-gray-400">Training follows British Association for Counselling & Psychotherapy guidelines.</p>
          </div>
        </div>
      </section>

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowLogin(false)}>
          <div className="bg-card rounded-xl border border-border w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <LogIn className="w-5 h-5 text-secondary" />
                Learner Login
              </h2>
              <button onClick={() => setShowLogin(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <form onSubmit={handleLogin} className="p-6">
              {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">{error}</div>}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Email Address</label>
                <input type="email" name="email" required className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none" placeholder="your@email.com" />
              </div>
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">Password</label>
                <input type="password" name="password" required className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none" placeholder="Your password" />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-primary-light hover:bg-primary text-white rounded-lg font-semibold disabled:opacity-50">
                {loading ? 'Signing in...' : 'Login'}
              </button>
              <p className="text-center mt-4 text-sm text-gray-400">
                Not enrolled? <button type="button" onClick={() => { setShowLogin(false); setShowRegister(true); }} className="text-secondary hover:underline">Register Interest</button>
              </p>
            </form>
          </div>
        </div>
      )}

      {/* Set Password Modal */}
      {showSetPassword && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-md">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-semibold">Set Your Password</h2>
              <p className="text-sm text-gray-400 mt-1">Welcome! Your registration has been approved. Please set a password.</p>
            </div>
            <form onSubmit={handleSetPassword} className="p-6">
              {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">{error}</div>}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">New Password</label>
                <input type="password" name="password" required minLength={8} className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none" placeholder="Minimum 8 characters" />
              </div>
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">Confirm Password</label>
                <input type="password" name="confirmPassword" required minLength={8} className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none" placeholder="Confirm your password" />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-secondary text-primary-dark rounded-lg font-semibold disabled:opacity-50">
                {loading ? 'Setting Password...' : 'Set Password & Continue'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Register Modal */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setShowRegister(false)}>
          <div className="bg-card rounded-xl border border-border w-full max-w-2xl my-8" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-secondary" />
                Register Interest
              </h2>
              <button onClick={() => setShowRegister(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <form onSubmit={handleRegister} className="p-6">
              {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">{error}</div>}
              
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Full Name *</label>
                  <input type="text" name="name" required className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Email Address *</label>
                  <input type="email" name="email" required className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none" />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Phone Number (Optional)</label>
                <input type="tel" name="phone" className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none" />
              </div>

              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="isVeteran" className="w-4 h-4 accent-secondary" />
                  <span className="text-sm">I am a veteran or currently serving</span>
                </label>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Why do you want to volunteer? *</label>
                <textarea name="why" required rows={4} className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none resize-none" placeholder="Tell us about your motivation..."></textarea>
              </div>

              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="hasDBS" className="w-4 h-4 accent-secondary" />
                  <span className="text-sm">I already have a valid DBS check</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">Don&apos;t worry if you don&apos;t - we&apos;ll help you apply for one.</p>
              </div>

              <div className="mb-6">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" name="terms" required className="w-4 h-4 accent-secondary mt-1" />
                  <span className="text-sm">I agree to the terms and conditions and understand this is a volunteer position *</span>
                </label>
              </div>

              <button type="submit" disabled={loading} className="w-full py-3 bg-secondary text-primary-dark rounded-lg font-semibold disabled:opacity-50">
                {loading ? 'Submitting...' : 'Submit Registration'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
