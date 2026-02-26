import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_URL } from '../config/api';
interface User { id: string; email: string; role: string; name: string; }
interface AuthContextType { user: User|null; token: string|null; isLoading: boolean; login:(e:string,p:string)=>Promise<{success:boolean;error?:string}>; logout:()=>void; }
const AuthContext = createContext<AuthContextType|undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User|null>(null);
  const [token, setToken] = useState<string|null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const t = localStorage.getItem('auth_token');
    const u = localStorage.getItem('auth_user');
    if (t && u) { setToken(t); setUser(JSON.parse(u)); }
    setIsLoading(false);
  }, []);
  const login = async (email: string, password: string) => {
    try {
      const r = await fetch(`${API_URL}/api/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,password}) });
      if (!r.ok) { const e = await r.json(); return { success:false, error:e.detail||'Login failed' }; }
      const d = await r.json();
      setToken(d.access_token); setUser(d.user);
      localStorage.setItem('auth_token', d.access_token);
      localStorage.setItem('auth_user', JSON.stringify(d.user));
      return { success: true };
    } catch { return { success:false, error:'Network error. Please try again.' }; }
  };
  const logout = () => { setToken(null); setUser(null); localStorage.removeItem('auth_token'); localStorage.removeItem('auth_user'); };
  return <AuthContext.Provider value={{user,token,isLoading,login,logout}}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth must be used within an AuthProvider');
  return c;
}
