'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { lmsAdminApi, AdminUser } from '@/lib/api';

interface AdminAuthContextType {
  user: AdminUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('lms_admin_token');
    const storedUser = localStorage.getItem('lms_admin_user');
    
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        logout();
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await lmsAdminApi.login(email, password);
    
    if (response.user?.role !== 'admin') {
      throw new Error('Access denied. Admin privileges required.');
    }
    
    setToken(response.token);
    setUser(response.user);
    localStorage.setItem('lms_admin_token', response.token);
    localStorage.setItem('lms_admin_user', JSON.stringify(response.user));
  };

  const logout = () => {
    localStorage.removeItem('lms_admin_token');
    localStorage.removeItem('lms_admin_user');
    setUser(null);
    setToken(null);
  };

  return (
    <AdminAuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
