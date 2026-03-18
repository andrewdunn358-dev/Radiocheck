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
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        loadProfile(storedToken, parsedUser?.id);
      } catch {
        logout();
      }
    } else {
      setIsLoading(false);
    }
  }, [checkSession]);

  const loadProfile = async (authToken: string, userId?: string) => {
    try {
      const profileData = await staffApi.getProfile(authToken, userId);
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
    
    await loadProfile(response.token, response.user?.id);
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
    if (!token) {
      console.error('Cannot update status: no token');
      return;
    }
    
    // If we have a profile, use it for the API call
    if (profile) {
      try {
        const staffType = profile.role === 'counsellor' ? 'counsellor' : 'peer';
        const staffId = profile.id || (profile as any)._id;
        
        if (staffId) {
          await staffApi.updateStatus(token, status, staffId, staffType);
          setProfile({ ...profile, status: status as StaffProfile['status'] });
          localStorage.setItem('staff_status', status);
          console.log('Status updated to:', status);
          return;
        }
      } catch (error) {
        console.error('Failed to update status via profile:', error);
      }
    }
    
    // Fallback: If no profile, try to find one by user role
    if (user) {
      try {
        const staffType = user.role === 'counsellor' ? 'counsellor' : 'peer';
        const endpoint = staffType === 'counsellor' ? '/counsellors' : '/peer-supporters';
        
        // Get all staff of this type and find the first one (to at least update something)
        const staffList = await staffApi.getProfile(token);
        if (staffList) {
          const staffId = staffList.id || (staffList as any)._id;
          if (staffId) {
            await staffApi.updateStatus(token, status, staffId, staffType);
            setProfile({ ...staffList, status: status as StaffProfile['status'] });
            localStorage.setItem('staff_status', status);
            console.log('Status updated to:', status, '(using fallback)');
            return;
          }
        }
      } catch (error) {
        console.error('Failed to update status via fallback:', error);
      }
    }
    
    // Last resort - just update local storage
    localStorage.setItem('staff_status', status);
    console.log('Status saved locally (no profile to update):', status);
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
