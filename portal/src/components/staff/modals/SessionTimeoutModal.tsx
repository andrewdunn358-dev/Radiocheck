'use client';

import { Clock } from 'lucide-react';

interface SessionTimeoutModalProps {
  onStayLoggedIn: () => void;
}

export default function SessionTimeoutModal({
  onStayLoggedIn,
}: SessionTimeoutModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-yellow-500 rounded-xl w-full max-w-md p-6 text-center">
        <Clock className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Session Expiring Soon</h2>
        <p className="text-gray-400 mb-6">
          You will be logged out in 5 minutes due to inactivity. 
          Click anywhere or press any key to stay logged in.
        </p>
        <button
          onClick={onStayLoggedIn}
          className="px-6 py-3 bg-secondary text-primary-dark rounded-lg font-semibold hover:bg-secondary-light"
        >
          Stay Logged In
        </button>
      </div>
    </div>
  );
}
