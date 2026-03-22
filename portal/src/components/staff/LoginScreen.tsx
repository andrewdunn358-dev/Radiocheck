'use client';

import { useState } from 'react';

interface LoginScreenProps {
  onLogin: (email: string, password: string, rememberMe: boolean) => Promise<void>;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await onLogin(loginEmail, loginPassword, rememberMe);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-dark via-primary to-primary-dark p-4">
      <div className="bg-card border border-border rounded-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <img 
            src="https://customer-assets.emergentagent.com/job_b298e80e-e613-4114-bd36-44dba2b1f918/artifacts/hcklvnmw_logo.png" 
            alt="Radio Check" 
            className="w-20 h-20 mx-auto mb-4" 
          />
          <h2 className="text-2xl font-bold">Staff Portal</h2>
          <p className="text-gray-400 text-sm mt-1">Sign in to access the staff dashboard</p>
        </div>
        
        {loginError && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
            {loginError}
          </div>
        )}
        
        <form onSubmit={handleLogin} data-testid="login-form">
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Email Address</label>
            <input
              type="email"
              data-testid="login-email"
              autoComplete="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
              placeholder="your@email.com"
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">Password</label>
            <input
              type="password"
              data-testid="login-password"
              autoComplete="current-password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
              placeholder="Enter your password"
            />
          </div>
          <div className="mb-6 flex items-center">
            <input
              type="checkbox"
              id="remember-me"
              data-testid="remember-me-checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 mr-2 rounded border-gray-600 bg-primary-dark text-secondary focus:ring-secondary"
            />
            <label htmlFor="remember-me" className="text-sm text-gray-400 cursor-pointer">
              Remember me on this device
            </label>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            For shared computers, leave unchecked to automatically log out when you close the browser.
          </p>
          <button
            type="submit"
            data-testid="login-submit"
            disabled={loginLoading}
            className="w-full py-3 bg-primary-light hover:bg-primary text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {loginLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
