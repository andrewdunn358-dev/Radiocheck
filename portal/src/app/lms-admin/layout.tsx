'use client';

import { AdminAuthProvider } from '@/hooks/useAdminAuth';

export default function LMSAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthProvider>
      {children}
    </AdminAuthProvider>
  );
}
