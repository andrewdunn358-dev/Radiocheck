'use client';

import { StaffAuthProvider } from '@/hooks/useStaffAuth';

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StaffAuthProvider>
      {children}
    </StaffAuthProvider>
  );
}
