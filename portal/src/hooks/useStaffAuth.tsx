'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { staffApi, StaffUser, StaffProfile } from '@/lib/api';

interface StaffAuthContextType {
  user: StaffUser | null;
  profile: StaffProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  updateStatus: (status: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const StaffAuthContext = createContext<StaffAuthContextType | undefined>(undefined);

// Session timeout - 2 hours
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;

// Helper to get the appropriate storage based on "remember me" preference
const getStorage = (): Storage => {
  // Check if user chose to be remembered (stored in localStorage)
  const rememberMe = localStorage.getItem('staff_remember_me') === 'true';
  return rememberMe ? localStorage : sessionStorage;
};

// Helper to set auth data in the appropriate storage
const setAuthData = (key: string, value: string, rememberMe?: boolean) => {
  if (rememberMe !== undefined) {
    // If explicitly setting, use the requested storage
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem(key, value);
    // Clear from the other storage to avoid confusion
    const otherStorage = rememberMe ? sessionStorage : localStorage;
    otherStorage.removeItem(key);
  } else {
    // Otherwise use the current preference
    getStorage().setItem(key, value);
  }
};

// Helper to get auth data from either storage
const getAuthData = (key: string): string | null => {
  // Check localStorage first (for "remembered" sessions)
  const localValue = localStorage.getItem(key);
  if (localValue) return localValue;
  // Then check sessionStorage
  return sessionStorage.getItem(key);
};

// Helper to clear auth data from both storages
const clearAuthData = (key: string) => {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
};

export function StaffAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());

  // Check session expiry
  const checkSession = useCallback(() => {
    const storedLastActivity = getAuthData('staff_last_activity');
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
    setAuthData('staff_last_activity', now.toString());
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

  // Initialize from storage (checks both localStorage and sessionStorage)
  useEffect(() => {
    const storedToken = getAuthData('staff_token');
    const storedUser = getAuthData('staff_user');

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
      console.log('[StaffAuth] Loading profile for userId:', userId);
      const profileData = await staffApi.getProfile(authToken, userId);
      
      // CRITICAL: Only set profile if it matches the logged-in user
      if (profileData && userId) {
        // Verify the profile belongs to this user
        if (profileData.id === userId || (profileData as any).user_id === userId || (profileData as any)._id === userId) {
          console.log('[StaffAuth] Profile loaded successfully:', profileData.name);
          setProfile(profileData);
        } else {
          console.warn('[StaffAuth] Profile user_id mismatch! Expected:', userId, 'Got:', profileData.id || (profileData as any).user_id);
          setProfile(null);
        }
      } else if (!profileData) {
        console.log('[StaffAuth] No profile found for user - this is OK, some features will be limited');
        setProfile(null);
      }
    } catch (error) {
      console.error('[StaffAuth] Failed to load profile:', error);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Login with optional "remember me" - defaults to session-only (no persistence)
  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    const response = await staffApi.login(email, password);
    
    // Store the remember me preference
    if (rememberMe) {
      localStorage.setItem('staff_remember_me', 'true');
    } else {
      localStorage.removeItem('staff_remember_me');
    }
    
    setToken(response.token);
    setUser(response.user);
    
    // Use the appropriate storage based on rememberMe
    setAuthData('staff_token', response.token, rememberMe);
    setAuthData('staff_user', JSON.stringify(response.user), rememberMe);
    setAuthData('staff_token_time', Date.now().toString(), rememberMe);
    resetActivity();
    
    await loadProfile(response.token, response.user?.id);
  };

  const logout = () => {
    // Clear from both storages to ensure complete logout
    clearAuthData('staff_token');
    clearAuthData('staff_user');
    clearAuthData('staff_token_time');
    clearAuthData('staff_last_activity');
    clearAuthData('staff_status');
    localStorage.removeItem('staff_remember_me');
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
        // Use the profile's role to determine the correct endpoint
        const staffType = profile.role === 'counsellor' ? 'counsellor' : 'peer';
        const staffId = profile.id || (profile as any)._id;
        
        console.log('Updating status:', { status, staffType, staffId, profileRole: profile.role });
        
        if (staffId) {
          await staffApi.updateStatus(token, status, staffId, staffType);
          setProfile({ ...profile, status: status as StaffProfile['status'] });
          setAuthData('staff_status', status);
          console.log('Status updated to:', status);
          return;
        }
      } catch (error) {
        console.error('Failed to update status:', error);
      }
    }
    
    // No profile - just save locally
    setAuthData('staff_status', status);
    console.log('Status saved locally (no profile):', status);
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
