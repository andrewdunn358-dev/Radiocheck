'use client';

import { LearnerAuthProvider } from '@/hooks/useLearnerAuth';

export default function LearningLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LearnerAuthProvider>
      {children}
    </LearnerAuthProvider>
  );
}
