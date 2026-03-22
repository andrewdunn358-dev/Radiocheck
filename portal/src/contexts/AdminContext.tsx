'use client';

// Admin Context
// Provides shared state for admin portal components
// 
// TODO: Split into StaffContext, LogsContext, GovernanceContext 
// after Phase 2 tab extraction is complete. Currently keeping state
// in the main page component to avoid premature complexity.

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

interface AdminContextType {
  // Notifications
  error: string | null;
  setError: (error: string | null) => void;
  success: string | null;
  setSuccess: (success: string | null) => void;
  
  // UI state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  
  // Alert counter (real-time)
  pendingAlertCount: number;
  setPendingAlertCount: (count: number) => void;
}

const AdminContext = createContext<AdminContextType | null>(null);

interface AdminProviderProps {
  children: ReactNode;
}

export function AdminProvider({ children }: AdminProviderProps) {
  // Notifications
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('staff');
  
  // Alert counter
  const [pendingAlertCount, setPendingAlertCount] = useState(0);
  
  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);
  
  const value: AdminContextType = {
    error,
    setError,
    success,
    setSuccess,
    sidebarOpen,
    setSidebarOpen,
    activeTab,
    setActiveTab,
    pendingAlertCount,
    setPendingAlertCount,
  };
  
  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextType {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
