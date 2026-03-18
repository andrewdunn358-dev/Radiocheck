'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { lmsApi, LearnerData, ProgressData } from '@/lib/api';

interface AuthContextType {
  learner: LearnerData | null;
  token: string | null;
  progress: ProgressData | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ needsPassword?: boolean }>;
  setPassword: (email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => void;
  refreshProgress: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function LearnerAuthProvider({ children }: { children: ReactNode }) {
  const [learner, setLearner] = useState<LearnerData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored session
    const storedToken = localStorage.getItem('lms_token');
    const storedEmail = localStorage.getItem('lms_learner_email');
    
    if (storedToken && storedEmail) {
      setToken(storedToken);
      loadProgress(storedEmail);
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadProgress = async (email: string) => {
    try {
      const data = await lmsApi.getProgress(email);
      setLearner(data.learner);
      setProgress(data);
    } catch (error) {
      console.error('Failed to load progress:', error);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await lmsApi.login(email, password);
      setToken(response.token);
      localStorage.setItem('lms_token', response.token);
      localStorage.setItem('lms_learner_email', email);
      await loadProgress(email);
      return {};
    } catch (error: any) {
      if (error.message?.includes('Password not set')) {
        return { needsPassword: true };
      }
      throw error;
    }
  };

  const setPassword = async (email: string, password: string, confirmPassword: string) => {
    const response = await lmsApi.setPassword(email, password, confirmPassword);
    setToken(response.token);
    localStorage.setItem('lms_token', response.token);
    localStorage.setItem('lms_learner_email', email);
    await loadProgress(email);
  };

  const logout = () => {
    localStorage.removeItem('lms_token');
    localStorage.removeItem('lms_learner_email');
    setLearner(null);
    setToken(null);
    setProgress(null);
  };

  const refreshProgress = async () => {
    if (learner?.email) {
      await loadProgress(learner.email);
    }
  };

  return (
    <AuthContext.Provider value={{ learner, token, progress, isLoading, login, setPassword, logout, refreshProgress }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useLearnerAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useLearnerAuth must be used within a LearnerAuthProvider');
  }
  return context;
}
