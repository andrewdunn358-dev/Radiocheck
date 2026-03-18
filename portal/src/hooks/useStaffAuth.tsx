'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { staffApi, StaffUser, StaffProfile } from '@/lib/api';

interface StaffAuthContextType {
  user: StaffUser | null;
  profile: StaffProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateStatus: (status: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const StaffAuthContext = createContext<StaffAuthContextType | undefined>(undefined);

// Session timeout - 2 hours
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;

export function StaffAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());

  // Check session expiry
  const checkSession = useCallback(() => {
    const storedLastActivity = localStorage.getItem('staff_last_activity');
    if (storedLastActivity) {
      const timeSinceActivity = Date.now() - parseInt(storedLastActivity);
      if (timeSinceActivity > SESSION_TIMEOUT_MS) {
        logout();
        return false;
      }
    }
    return true;
  }, []);

  // Reset activity timer
  const resetActivity = useCallback(() => {
    const now = Date.now();
    setLastActivity(now);
    localStorage.setItem('staff_last_activity', now.toString());
  }, []);

  // Setup activity listeners
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, resetActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetActivity);
      });
    };
  }, [resetActivity]);

  // Check session periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (token && !checkSession()) {
        console.log('Session expired due to inactivity');
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [token, checkSession]);

  // Initialize from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('staff_token');
    const storedUser = localStorage.getItem('staff_user');

    if (storedToken && storedUser && checkSession()) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        loadProfile(storedToken);
      } catch {
        logout();
      }
    } else {
      setIsLoading(false);
    }
  }, [checkSession]);

  const loadProfile = async (authToken: string) => {
    try {
      const profileData = await staffApi.getProfile(authToken);
      setProfile(profileData);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await staffApi.login(email, password);
    
    setToken(response.token);
    setUser(response.user);
    localStorage.setItem('staff_token', response.token);
    localStorage.setItem('staff_user', JSON.stringify(response.user));
    localStorage.setItem('staff_token_time', Date.now().toString());
    resetActivity();
    
    await loadProfile(response.token);
  };

  const logout = () => {
    localStorage.removeItem('staff_token');
    localStorage.removeItem('staff_user');
    localStorage.removeItem('staff_token_time');
    localStorage.removeItem('staff_last_activity');
    setUser(null);
    setProfile(null);
    setToken(null);
  };

  const updateStatus = async (status: string) => {
    if (!token) return;
    await staffApi.updateStatus(token, status);
    if (profile) {
      setProfile({ ...profile, status: status as StaffProfile['status'] });
    }
  };

  const refreshProfile = async () => {
    if (token) {
      await loadProfile(token);
    }
  };

  return (
    <StaffAuthContext.Provider value={{ 
      user, 
      profile, 
      token, 
      isLoading, 
      login, 
      logout, 
      updateStatus,
      refreshProfile 
    }}>
      {children}
    </StaffAuthContext.Provider>
  );
}

export function useStaffAuth() {
  const context = useContext(StaffAuthContext);
  if (context === undefined) {
    throw new Error('useStaffAuth must be used within a StaffAuthProvider');
  }
  return context;
}
