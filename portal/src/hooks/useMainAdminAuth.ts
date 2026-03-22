'use client';

// Main Admin Auth Hook
// Extracted from /app/portal/src/app/admin/page.tsx
// Note: This is different from useAdminAuth.tsx which is for LMS Admin

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/admin-api';
import type { User } from '@/types/admin';

interface UseMainAdminAuthReturn {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  loginEmail: string;
  setLoginEmail: (email: string) => void;
  loginPassword: string;
  setLoginPassword: (password: string) => void;
  loginLoading: boolean;
  loginError: string;
  rememberMe: boolean;
  setRememberMe: (value: boolean) => void;
  login: (e: React.FormEvent) => Promise<void>;
  logout: () => void;
}

export function useMainAdminAuth(): UseMainAdminAuthReturn {
  // Auth state
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Logout handler - defined first so it can be used in useEffect
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    // Don't clear saved credentials on logout - only clear the session
  }, []);

  // Check for saved credentials (NOT session - session requires fresh login)
  useEffect(() => {
    // Load saved credentials if "Remember me" was previously checked
    const savedEmail = localStorage.getItem('admin_saved_email');
    const savedPassword = localStorage.getItem('admin_saved_password');
    if (savedEmail) {
      setLoginEmail(savedEmail);
      setRememberMe(true);
    }
    if (savedPassword) {
      setLoginPassword(savedPassword);
    }
    // No token persistence - user must login each time they open the page
    setIsLoading(false);

    // Strip sensitive params from URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('password') || url.searchParams.has('email')) {
        url.searchParams.delete('password');
        url.searchParams.delete('email');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, []);

  // Session timeout management (2hr inactivity) - session only lasts while page is open
  useEffect(() => {
    if (!token) return;

    const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours inactivity timeout

    // Activity tracking (in-memory only)
    let lastActivity = Date.now();

    const resetActivity = () => {
      lastActivity = Date.now();
    };

    // Check for timeout every minute
    const timeoutChecker = setInterval(() => {
      const now = Date.now();
      const inactiveTime = now - lastActivity;

      if (inactiveTime > SESSION_TIMEOUT) {
        logout();
      }
    }, 60000); // Check every minute

    // Activity listeners
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => window.addEventListener(event, resetActivity));

    return () => {
      clearInterval(timeoutChecker);
      events.forEach(event => window.removeEventListener(event, resetActivity));
    };
  }, [token, logout]);

  // Login handler
  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const response = await api.login(loginEmail, loginPassword);

      // Check if user is admin
      if (response.user.role !== 'admin') {
        setLoginError('Access denied. Admin role required.');
        return;
      }

      setToken(response.token);
      setUser(response.user);

      // Save credentials if "Remember me" is checked (NOT the session token)
      if (rememberMe) {
        localStorage.setItem('admin_saved_email', loginEmail);
        localStorage.setItem('admin_saved_password', loginPassword);
      } else {
        localStorage.removeItem('admin_saved_email');
        localStorage.removeItem('admin_saved_password');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  return {
    token,
    user,
    isLoading,
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    loginLoading,
    loginError,
    rememberMe,
    setRememberMe,
    login,
    logout,
  };
}
